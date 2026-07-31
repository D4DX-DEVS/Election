const { sameFranchise } = require("./roles");
const users = require("./supabase/users");

function resolveElectionFranchiseId(election) {
  if (!election?.franchiseId) return "";
  const franchise = election.franchiseId;
  if (typeof franchise === "object" && franchise !== null) {
    return String(franchise._id || franchise.id || "");
  }
  return String(franchise);
}

function resolveElectionId(election) {
  return String(election?._id || election?.id || "");
}

/**
 * Whether the user may access a specific election (results, ballot, workspace, etc.).
 * - super_admin: all elections
 * - franchise_admin: elections in their franchise
 * - election_admin: elections in electionAccess
 * - voter: elections assigned via user_election_access
 */
async function canAccessElection(user, election) {
  if (!user || !election) return false;

  const electionId = resolveElectionId(election);
  if (!electionId) return false;

  if (user.role === "super_admin") return true;

  if (user.role === "franchise_admin") {
    return sameFranchise(user.franchiseId, resolveElectionFranchiseId(election));
  }

  if (user.role === "election_admin") {
    const access = Array.isArray(user.electionAccess) ? user.electionAccess.map(String) : [];
    return (
      sameFranchise(user.franchiseId, resolveElectionFranchiseId(election)) &&
      access.includes(electionId)
    );
  }

  if (user.role === "voter") {
    // Archived elections are admin-only — voters cannot reach them even with
    // a direct link, regardless of assignment.
    if (election.status === "archived") return false;
    if (!sameFranchise(user.franchiseId, resolveElectionFranchiseId(election))) {
      return false;
    }
    return users.userHasElectionAccess(String(user._id || user.id), electionId);
  }

  return false;
}

async function assertCanAccessElection(user, election, message) {
  const allowed = await canAccessElection(user, election);
  if (!allowed) {
    const err = new Error(message || "You are not allowed to access this election.");
    err.statusCode = 403;
    throw err;
  }
}

/** Send 403 and return true when access is denied (for early return in controllers). */
async function denyUnlessCanAccessElection(req, res, election, message) {
  if (!(await canAccessElection(req.user, election))) {
    res.status(403).json({
      success: false,
      message: message || "You are not allowed to access this election.",
    });
    return true;
  }
  return false;
}

module.exports = {
  canAccessElection,
  assertCanAccessElection,
  denyUnlessCanAccessElection,
  resolveElectionFranchiseId,
  resolveElectionId,
};
