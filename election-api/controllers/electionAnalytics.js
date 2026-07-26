const electionAnalytics = require("../lib/supabase/electionAnalytics");
const elections = require("../lib/elections");
const votes = require("../lib/supabase/votes");
const franchises = require("../lib/supabase/franchises");
const users = require("../lib/supabase/users");
const { sendVoteReminders: runSendVoteReminders } = require("../lib/reminders/sendVoteReminders");
const { logUserActivity, logAuditFromReq } = require("../utils/auditLog");
const { canAccessElection, denyUnlessCanAccessElection } = require("../lib/electionAccess");

async function filterAnalyticsForUser(user, rows) {
  const filtered = [];
  for (const row of rows) {
    if (!row?.electionId) {
      if (user?.role === "super_admin") filtered.push(row);
      continue;
    }
    const election = await elections.findById(row.electionId);
    if (election && (await canAccessElection(user, election))) {
      filtered.push(row);
    }
  }
  return filtered;
}

exports.getDashboardStats = async (req, res) => {
  try {
    const role = req.user?.role;
    const franchiseId = req.user?.franchiseId;
    const electionFilter = {};

    if (role === "franchise_admin" && franchiseId) {
      electionFilter.franchiseId = franchiseId;
    } else if (role === "election_admin") {
      const ids = Array.isArray(req.user?.electionAccess) ? req.user.electionAccess : [];
      electionFilter.ids = ids;
      electionFilter.franchiseId = franchiseId;
    }

    const electionList = await elections.findLean(electionFilter);
    const electionIds = electionList.map((e) => e._id);
    const totalElections = electionList.length;
    const activeElections = electionList.filter(
      (e) => e.status === "active" || e.votingOpen === true
    ).length;

    const voterFilter = { isVoter: true };
    if (
      (role === "franchise_admin" || role === "election_admin") &&
      franchiseId
    ) {
      voterFilter.franchiseId = franchiseId;
    }
    const totalVoters = await users.countDocuments(voterFilter);

    const voteFilter = electionIds.length ? { electionIds } : { electionIds: [] };
    const votesCast = electionIds.length ? await votes.countDocuments(voteFilter) : 0;

    const totalFranchises =
      role === "super_admin"
        ? await franchises.countDocuments()
        : franchiseId
        ? 1
        : 0;

    let franchiseDistribution = [];
    if (role === "super_admin") {
      const franchiseList = await franchises.findLean();
      const countMap = await elections.countByFranchise();
      const total =
        Object.values(countMap).reduce((a, b) => a + b, 0) || 1;
      franchiseDistribution = franchiseList.map((f) => ({
        id: f._id || f.id,
        name: f.name,
        websiteUrl: f.websiteUrl || null,
        contactNumber: f.contactNumber || null,
        electionCount: countMap[String(f._id || f.id)] || 0,
        percentage: Math.round(((countMap[String(f._id || f.id)] || 0) / total) * 100),
      }));
    } else if (role === "franchise_admin" && franchiseId) {
      const franchise = await franchises.findById(franchiseId);
      if (franchise) {
        const countMap = await elections.countByFranchise();
        franchiseDistribution = [
          {
            id: franchise._id || franchise.id,
            name: franchise.name,
            websiteUrl: franchise.websiteUrl || null,
            contactNumber: franchise.contactNumber || null,
            electionCount: countMap[String(franchise._id || franchise.id)] || 0,
            percentage: 100,
          },
        ];
      }
    }

    const recentActivity = electionList
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
      .map((e) => ({
        action: `Election "${e.title || "Untitled"}" ${e.status || "created"}`,
        timestamp: e.createdAt ? new Date(e.createdAt).toLocaleString() : "",
        type:
          e.status === "active"
            ? "success"
            : e.status === "completed"
            ? "info"
            : "warning",
      }));

    return res.status(200).json({
      success: true,
      data: {
        activeElections,
        totalVoters,
        votesCast,
        totalFranchises,
        totalElections,
        franchiseDistribution,
        recentActivity,
      },
    });
  } catch (err) {
    console.error("Controller Error in getDashboardStats:", err.message);
    res.status(500).json({ success: false, message: err.toString() });
  }
};

exports.sendVoteReminders = async (req, res) => {
  try {
    const { electionId } = req.params;
    const election = await elections.findById(electionId);
    if (!election) {
      return res.status(404).json({ success: false, message: "Election not found." });
    }
    if (await denyUnlessCanAccessElection(req, res, election)) return;

    const result = await runSendVoteReminders(electionId);

    await logUserActivity(
      req.user._id,
      req.ip,
      "Sent vote reminders",
      `${result.emailsSent} emails · ${result.pendingCount} pending`,
      "Election"
    );

    res.status(200).json({ success: true, data: result });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    console.error("Controller Error in sendVoteReminders:", err.message);
    res.status(500).json({ success: false, message: err.toString() });
  }
};

exports.addElectionAnalytics = async (req, res) => {
  try {
    if (req.body?.electionId) {
      const election = await elections.findById(req.body.electionId);
      if (!election) {
        return res.status(404).json({ success: false, message: "Election not found." });
      }
      if (await denyUnlessCanAccessElection(req, res, election)) return;
    } else if (req.user?.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to create analytics without an election.",
      });
    }

    const analytics = await electionAnalytics.create(req.body);
    const label = analytics.electionId ? `election ${analytics.electionId}` : "analytics record";
    await logAuditFromReq(req, "Created", label, "Election Analytics", analytics._id || analytics.id);
    res.status(201).json({ success: true, message: "Election analytics created.", analytics });
  } catch (err) {
    console.error("Controller Error in addElectionAnalytics:", err.message);
    res.status(500).json({ success: false, message: err.toString() });
  }
};

exports.getElectionAnalytics = async (req, res) => {
  try {
    const data = await filterAnalyticsForUser(req.user, await electionAnalytics.findAll());
    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("Controller Error in getElectionAnalytics:", err.message);
    res.status(500).json({ success: false, message: err.toString() });
  }
};

exports.getElectionAnalytic = async (req, res) => {
  try {
    const { id } = req.params;
    const analytic = await electionAnalytics.findById(id);
    if (!analytic) {
      return res.status(404).json({ success: false, message: "Election analytic not found." });
    }
    if (analytic.electionId) {
      const election = await elections.findById(analytic.electionId);
      if (!election) {
        return res.status(404).json({ success: false, message: "Election not found." });
      }
      if (await denyUnlessCanAccessElection(req, res, election)) return;
    } else if (req.user?.role !== "super_admin") {
      return res.status(403).json({ success: false, message: "You are not allowed to access this analytic." });
    }
    res.status(200).json({ success: true, data: analytic });
  } catch (err) {
    console.error("Controller Error in getElectionAnalytic:", err.message);
    res.status(500).json({ success: false, message: err.toString() });
  }
};

exports.updateElectionAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await electionAnalytics.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Election analytics not found." });
    }
    const electionId = req.body?.electionId || existing.electionId;
    if (electionId) {
      const election = await elections.findById(electionId);
      if (!election) {
        return res.status(404).json({ success: false, message: "Election not found." });
      }
      if (await denyUnlessCanAccessElection(req, res, election)) return;
    } else if (req.user?.role !== "super_admin") {
      return res.status(403).json({ success: false, message: "You are not allowed to update this analytic." });
    }

    const analytics = await electionAnalytics.updateById(id, req.body);
    if (!analytics) {
      return res.status(404).json({ success: false, message: "Election analytics not found." });
    }
    const label = analytics.electionId ? `election ${analytics.electionId}` : "analytics record";
    await logAuditFromReq(req, "Updated", label, "Election Analytics", analytics._id || analytics.id);
    res.status(200).json({ success: true, data: analytics });
  } catch (err) {
    console.error("Controller Error in updateElectionAnalytics:", err.message);
    res.status(500).json({ success: false, message: err.toString() });
  }
};

exports.deleteElectionAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await electionAnalytics.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Election analytics not found." });
    }
    if (existing.electionId) {
      const election = await elections.findById(existing.electionId);
      if (!election) {
        return res.status(404).json({ success: false, message: "Election not found." });
      }
      if (await denyUnlessCanAccessElection(req, res, election)) return;
    } else if (req.user?.role !== "super_admin") {
      return res.status(403).json({ success: false, message: "You are not allowed to delete this analytic." });
    }

    const analytics = await electionAnalytics.deleteById(id);
    if (!analytics) {
      return res.status(404).json({ success: false, message: "Election analytics not found." });
    }
    const label = existing.electionId ? `election ${existing.electionId}` : "analytics record";
    await logAuditFromReq(req, "Deleted", label, "Election Analytics", existing._id || existing.id);
    res.status(200).json({ success: true, message: "Election analytics deleted successfully." });
  } catch (err) {
    console.error("Controller Error in deleteElectionAnalytics:", err.message);
    res.status(500).json({ success: false, message: err.toString() });
  }
};
