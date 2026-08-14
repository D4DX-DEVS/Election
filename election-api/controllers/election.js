const elections = require("../lib/elections");
const nominees = require("../lib/supabase/nominees");
const { enrichElectionsWithCounts } = require("../lib/supabase/electionCounts");
const { logUserActivity, logAuditFromReq } = require("../utils/auditLog");
const { denyUnlessCanAccessElection } = require("../lib/electionAccess");
const {
  applyElectionLifecycleRules,
  syncElectionLifecycle,
} = require("../lib/electionLifecycle");
const { normalizeElectionBody } = require("../lib/electionBody");
const { resolveFranchiseIdForActor } = require("../lib/roles");
const franchises = require("../lib/supabase/franchises");
const users = require("../lib/supabase/users");
const votes = require("../lib/supabase/votes");
const { requireFranchiseId } = require("../lib/tenantScope");

function isValidNameField(value) {
  const trimmed = String(value || "").trim();
  return trimmed.length > 0 && !/\d/.test(trimmed) && /[a-zA-Z]/.test(trimmed);
}

exports.addElection = async (req, res) => {
  try {
    if (!isValidNameField(req.body.organization)) {
      return res.status(400).json({
        success: false,
        message: "Election name cannot contain numbers.",
      });
    }
    req.body.franchiseId = requireFranchiseId(
      resolveFranchiseIdForActor(req.user, req.body.franchiseId)
    );
    const duplicate = await elections.findByOrganization(req.body.organization, req.body.franchiseId);
    if (duplicate) {
      return res.status(409).json({ success: false, message: "An election with this name already exists." });
    }
    req.body.createdBy = req.user._id || req.user.id;
    normalizeElectionBody(req.body);
    applyElectionLifecycleRules(req.body);
    if (req.file?.cdnUrl) {
      req.body.logo = { url: req.file.cdnUrl, alt: req.body.title };
    }
    const election = await elections.create(req.body);
    await logUserActivity(req.user._id, req.ip, "Created", election.title, "Election");
    res.status(201).json({ success: true, message: "Election created.", election });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.toString() });
  }
};

exports.getElectionById = async (req, res) => {
  try {
    const election = await elections.findById(req.params.id);
    if (!election) return res.status(404).json({ success: false, message: "Election not found." });
    if (await denyUnlessCanAccessElection(req, res, election)) return;
    const synced = await syncElectionLifecycle(election, elections.updateById);
    const [enriched] = await enrichElectionsWithCounts([synced]);

    // So voters can identify/confirm which organization's election they're in.
    const franchiseId = typeof enriched.franchiseId === "object" ? enriched.franchiseId?._id : enriched.franchiseId;
    if (franchiseId) {
      const franchise = await franchises.findById(franchiseId);
      if (franchise) {
        enriched.franchise = { name: franchise.name, logo: franchise.logo };
      }
    }

    res.status(200).json({ success: true, data: enriched });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.toString() });
  }
};

const LOCKED_ELECTION_STATUSES = new Set(["completed", "archived"]);

exports.updateElectionById = async (req, res) => {
  try {
    const existing = await elections.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Election not found." });
    }
    // Completing an election is final: it can never be reopened for voting.
    // Archiving it is the one permitted move, since that only retires the
    // record. "draft" is refused too — otherwise draft -> active would be a
    // trivial way around the rule. Unarchiving is allowed but only back to
    // "completed" — restoring the record without reopening voting.
    const isRetiring = existing.status === "completed" && req.body.status === "archived";
    const isRestoring = existing.status === "archived" && req.body.status === "completed";
    if (LOCKED_ELECTION_STATUSES.has(existing.status) && !isRetiring && !isRestoring) {
      const reopening =
        existing.status === "completed" &&
        (req.body.status === "active" || req.body.status === "draft");
      return res.status(403).json({
        success: false,
        message: reopening
          ? "A completed election cannot be reopened for voting. Create a new election instead."
          : "Completed or archived elections cannot be edited.",
      });
    }
    if (await denyUnlessCanAccessElection(req, res, existing)) return;

    // Retire/restore are status-only moves — a locked election must not be
    // editable by piggybacking other fields onto the same request.
    if (isRetiring || isRestoring) {
      req.body = { status: req.body.status };
    }

    // Only validate a name that is actually changing — elections created before
    // the no-digits rule keep their name, so editing their other settings must
    // not be blocked by it.
    const organizationChanged =
      req.body.organization !== undefined &&
      String(req.body.organization).trim() !== String(existing.organization || "").trim();
    if (organizationChanged) {
      if (!isValidNameField(req.body.organization)) {
        return res.status(400).json({
          success: false,
          message: "Election name cannot contain numbers.",
        });
      }
      const existingFranchiseId =
        typeof existing.franchiseId === "object" ? existing.franchiseId?._id : existing.franchiseId;
      const duplicate = await elections.findByOrganization(
        req.body.organization,
        existingFranchiseId,
        req.params.id
      );
      if (duplicate) {
        return res.status(409).json({ success: false, message: "An election with this name already exists." });
      }
    }

    // An election's organization is immutable after creation.
    delete req.body.franchiseId;
    delete req.body.createdBy;
    normalizeElectionBody(req.body);
    applyElectionLifecycleRules(req.body, existing);
    if (req.file?.cdnUrl) {
      req.body.logo = { url: req.file.cdnUrl, alt: req.body.title };
    }
    const election = await elections.updateById(req.params.id, req.body);
    if (!election) return res.status(404).json({ success: false, message: "Election not found." });
    await logAuditFromReq(req, "Updated", election.title || election.organization, "Election", election._id || election.id);
    res.status(200).json({ success: true, data: election });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.toString() });
  }
};

async function buildVotingStatusEntry(election) {
  const id = election._id || election.id;
  const [assignedIds, votedCount] = await Promise.all([
    users.getAssignedVoterIdsForElection(id),
    votes.countDocuments({ electionId: id }),
  ]);
  const totalVoters = assignedIds.length;
  return {
    electionId: id,
    title: election.title,
    organization: election.organization,
    totalVoters,
    votedCount,
    remainingCount: Math.max(totalVoters - votedCount, 0),
    turnoutPercent: totalVoters > 0 ? Math.round((votedCount / totalVoters) * 100) : 0,
  };
}

// Live status while voting is in progress: votes cast, remaining voters, and —
// for multi-post elections sharing an electionGroupId — a per-post breakdown.
exports.getVotingStatus = async (req, res) => {
  try {
    const election = await elections.findById(req.params.id);
    if (!election) return res.status(404).json({ success: false, message: "Election not found." });
    if (await denyUnlessCanAccessElection(req, res, election)) return;

    const current = await buildVotingStatusEntry(election);

    let posts = [current];
    if (election.electionGroupId) {
      const groupElections = await elections.find({ electionGroupId: election.electionGroupId });
      if (groupElections.length > 1) {
        posts = await Promise.all(groupElections.map(buildVotingStatusEntry));
      }
    }

    res.status(200).json({
      success: true,
      // "posts" is only populated when this election is part of a multi-post
      // group — each post has its own voter roster, so per-post numbers
      // (not a combined sum) are what's meaningful here.
      data: { current, posts: posts.length > 1 ? posts : [] },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.toString() });
  }
};

/**
 * Per-voter roster for the Live Status tab: who has voted (and how many
 * nominees they picked) vs who hasn't. Sorted by vote count desc, then username.
 */
exports.getVotingRoster = async (req, res) => {
  try {
    const election = await elections.findById(req.params.id);
    if (!election) return res.status(404).json({ success: false, message: "Election not found." });
    if (await denyUnlessCanAccessElection(req, res, election)) return;

    const electionId = election._id || election.id;
    const assignedIds = await users.getAssignedVoterIdsForElection(electionId);
    const [assignedUsers, voteList] = await Promise.all([
      users.findByIds(assignedIds, { includePassword: false }),
      votes.findByElection(electionId, { populateNominees: false, populateVoters: false }),
    ]);

    const voteByVoter = new Map();
    voteList.forEach((v) => voteByVoter.set(String(v.voterId), v));

    const voted = [];
    const notVoted = [];
    assignedUsers.forEach((u) => {
      const id = String(u._id || u.id);
      const entry = { id, username: u.username || "", fullName: u.fullName || "" };
      const vote = voteByVoter.get(id);
      if (vote) {
        voted.push({
          ...entry,
          voteCount: Array.isArray(vote.nominees) ? vote.nominees.length : 0,
          votedAt: vote.timestamp || null,
        });
      } else {
        notVoted.push(entry);
      }
    });

    const byUsername = (a, b) => String(a.username).localeCompare(String(b.username));
    voted.sort((a, b) => b.voteCount - a.voteCount || byUsername(a, b));
    notVoted.sort(byUsername);

    res.status(200).json({
      success: true,
      data: {
        voted,
        notVoted,
        totals: {
          assigned: assignedUsers.length,
          voted: voted.length,
          notVoted: notVoted.length,
        },
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.toString() });
  }
};

exports.deleteElectionById = async (req, res) => {
  try {
    const existing = await elections.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Election not found." });
    }
    if (LOCKED_ELECTION_STATUSES.has(existing.status)) {
      return res.status(403).json({
        success: false,
        message: "Completed or archived elections cannot be deleted.",
      });
    }
    if (await denyUnlessCanAccessElection(req, res, existing)) return;

    const election = await elections.deleteById(req.params.id);
    if (!election) return res.status(404).json({ success: false, message: "Election not found." });
    await logAuditFromReq(req, "Deleted", existing.title || existing.organization, "Election", existing._id || existing.id);
    res.status(200).json({ success: true, message: "Election deleted." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.toString() });
  }
};

exports.setManualWinners = async (req, res) => {
  try {
    const election = await elections.findById(req.params.id);
    if (!election) return res.status(404).json({ success: false, message: "Election not found." });
    if (await denyUnlessCanAccessElection(req, res, election)) return;
    if (LOCKED_ELECTION_STATUSES.has(election.status)) {
      return res.status(403).json({
        success: false,
        message: "Completed or archived elections cannot be edited.",
      });
    }
    if (!election.manualWinnerSelection) {
      return res.status(400).json({
        success: false,
        message: "Manual winner selection is not enabled for this election.",
      });
    }

    const { nomineeIds } = req.body;
    if (!Array.isArray(nomineeIds)) {
      return res.status(400).json({ success: false, message: "nomineeIds array is required." });
    }

    const seats = Math.max(parseInt(election.numberToBeElected, 10) || 1, 1);
    const uniqueIds = [...new Set(nomineeIds.map((id) => String(id)))];
    if (uniqueIds.length > seats) {
      return res.status(400).json({
        success: false,
        message: `Select at most ${seats} winner(s).`,
      });
    }

    if (uniqueIds.length) {
      const validNominees = await nominees.findByIdsAndElection(uniqueIds, req.params.id);
      if (validNominees.length !== uniqueIds.length) {
        return res.status(400).json({
          success: false,
          message: "One or more nominees are invalid for this election.",
        });
      }
    }

    const patch = { manualWinnerIds: uniqueIds };
    if (uniqueIds.length > 0 && election.status !== "archived") {
      patch.status = "completed";
      patch.votingOpen = false;
    }
    const updated = await elections.updateById(req.params.id, patch);
    await logUserActivity(req.user._id, req.ip, "Set Manual Winners", election.title, "Election");
    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.toString() });
  }
};

exports.publishResults = async (req, res) => {
  try {
    const existing = await elections.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Election not found." });
    if (await denyUnlessCanAccessElection(req, res, existing)) return;

    const publish = req.body.publish === undefined ? true : req.body.publish === true || req.body.publish === "true";
    const update = {
      resultsPublished: publish,
      resultsPublishedAt: publish ? new Date().toISOString() : null,
    };
    const election = await elections.updateById(req.params.id, update);
    if (!election) return res.status(404).json({ success: false, message: "Election not found." });
    await logUserActivity(
      req.user && req.user._id,
      req.ip,
      publish ? "Published Results" : "Unpublished Results",
      election.title,
      "Election"
    );
    res.status(200).json({ success: true, data: election });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.toString() });
  }
};

exports.getElections = async (req, res) => {
  try {
    const filter = {};
    const user = req.user || {};
    if (user.role === "franchise_admin") {
      filter.franchiseId = user.franchiseId;
    } else if (user.role === "election_admin") {
      const ids = Array.isArray(user.electionAccess) ? user.electionAccess : [];
      filter.ids = ids;
      filter.franchiseId = user.franchiseId;
    } else if (req.query.franchiseId) {
      filter.franchiseId = req.query.franchiseId;
    }
    if (req.query.status) filter.status = req.query.status;

    if (req.query.page !== undefined) {
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limit = Math.max(parseInt(req.query.limit || req.query.pageSize, 10) || 10, 1);
      const { elections: paged, total } = await elections.findWithPagination(filter, page, limit);
      const synced = await Promise.all(
        paged.map((e) => syncElectionLifecycle(e, elections.updateById))
      );
      const enriched = await enrichElectionsWithCounts(synced);
      const totalPages = Math.max(Math.ceil(total / limit), 1);
      return res.status(200).json({
        success: true,
        count: enriched.length,
        pagination: { total, page, pageSize: limit, totalPages },
        data: enriched,
      });
    }

    const list = await elections.find(filter);
    const synced = await Promise.all(
      list.map((e) => syncElectionLifecycle(e, elections.updateById))
    );
    const data = await enrichElectionsWithCounts(synced);
    res.status(200).json({ success: true, count: data.length, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.toString() });
  }
};
