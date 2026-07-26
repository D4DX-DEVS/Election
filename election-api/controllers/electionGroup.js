const electionGroups = require("../lib/supabase/electionGroups");
const { logUserActivity, logAuditFromReq } = require("../utils/auditLog");
const { resolveFranchiseIdForActor, sameFranchise } = require("../lib/roles");
const elections = require("../lib/elections");
const {
  requireFranchiseId,
  assertElectionIdsScoped,
} = require("../lib/tenantScope");

function sendError(res, err) {
  if (!err.statusCode) console.error(err);
  return res
    .status(err.statusCode || 500)
    .json({ success: false, message: err.message || err.toString() });
}

async function validateElections(actor, franchiseId, electionIds) {
  return assertElectionIdsScoped({
    actor,
    franchiseId,
    electionIds: electionIds || [],
    findElectionById: elections.findById,
  });
}

function resolveGroupFranchiseId(group) {
  if (!group?.franchiseId) return "";
  const src = group.franchiseId;
  if (typeof src === "object" && src !== null) {
    return String(src._id || src.id || "");
  }
  return String(src);
}

function assertElectionGroupAccess(user, group) {
  if (!group) return;
  if (user?.role === "super_admin") return;
  if (!sameFranchise(user?.franchiseId, resolveGroupFranchiseId(group))) {
    const err = new Error("You are not allowed to access this election group.");
    err.statusCode = 403;
    throw err;
  }
}

exports.addElectionGroup = async (req, res) => {
  try {
    const body = { ...req.body };
    const user = req.user || {};
    body.franchiseId = requireFranchiseId(
      resolveFranchiseIdForActor(user, body.franchiseId)
    );
    body.elections = await validateElections(user, body.franchiseId, body.elections);
    if (!body.createdBy && user._id) {
      body.createdBy = user._id;
    }
    const electionGroup = await electionGroups.create(body);
    await logUserActivity(req.user._id, req.ip, "Created", electionGroup.name, "Election Group");
    res.status(201).json({ success: true, message: "Election Group created.", electionGroup });
  } catch (err) {
    sendError(res, err);
  }
};

exports.getElectionGroupById = async (req, res) => {
  try {
    const eg = await electionGroups.findById(req.params.id);
    if (!eg) return res.status(404).json({ success: false, message: "Election Group not found." });
    assertElectionGroupAccess(req.user, eg);
    res.status(200).json({ success: true, data: eg });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.toString() });
  }
};

exports.updateElectionGroupById = async (req, res) => {
  try {
    const existing = await electionGroups.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Election Group not found." });
    assertElectionGroupAccess(req.user, existing);
    const franchiseId = requireFranchiseId(resolveGroupFranchiseId(existing));
    if (req.body.franchiseId && !sameFranchise(req.body.franchiseId, franchiseId)) {
      const err = new Error("An election group's organization cannot be changed.");
      err.statusCode = 400;
      throw err;
    }
    delete req.body.franchiseId;
    if (req.body.elections !== undefined) {
      req.body.elections = await validateElections(
        req.user,
        franchiseId,
        req.body.elections
      );
    }
    const eg = await electionGroups.updateById(req.params.id, req.body);
    if (!eg) return res.status(404).json({ success: false, message: "Election Group not found." });
    await logAuditFromReq(req, "Updated", eg.name, "Election Group", eg._id || eg.id);
    res.status(200).json({ success: true, data: eg });
  } catch (err) {
    sendError(res, err);
  }
};

exports.deleteElectionGroupById = async (req, res) => {
  try {
    const existing = await electionGroups.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Election Group not found." });
    assertElectionGroupAccess(req.user, existing);
    const eg = await electionGroups.deleteById(req.params.id);
    if (!eg) return res.status(404).json({ success: false, message: "Election Group not found." });
    await logAuditFromReq(req, "Deleted", eg.name, "Election Group", eg._id || eg.id);
    res.status(200).json({ success: true, message: "Election Group deleted." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.toString() });
  }
};

exports.getElectionGroups = async (req, res) => {
  try {
    const filter = {};
    const user = req.user || {};
    if (user.role === "franchise_admin") {
      filter.franchiseId = user.franchiseId;
    } else if (req.query.franchiseId) {
      filter.franchiseId = req.query.franchiseId;
    }

    if (req.query.page !== undefined) {
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limit = Math.max(parseInt(req.query.limit || req.query.pageSize, 10) || 10, 1);
      const { groups: paged, total } = await electionGroups.find(filter, { page, limit });
      const totalPages = Math.max(Math.ceil(total / limit), 1);
      return res.status(200).json({
        success: true,
        count: paged.length,
        pagination: { total, page, pageSize: limit, totalPages },
        data: paged,
      });
    }

    const { groups: data } = await electionGroups.find(filter);
    res.status(200).json({ success: true, count: data.length, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.toString() });
  }
};

exports.updateElectionGroup = async (req, res) => {
  try {
    const { id } = req.body;
    const existing = await electionGroups.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Election Group not found." });
    }
    assertElectionGroupAccess(req.user, existing);
    const franchiseId = requireFranchiseId(resolveGroupFranchiseId(existing));
    if (req.body.franchiseId && !sameFranchise(req.body.franchiseId, franchiseId)) {
      const err = new Error("An election group's organization cannot be changed.");
      err.statusCode = 400;
      throw err;
    }
    delete req.body.franchiseId;
    if (req.body.elections !== undefined) {
      req.body.elections = await validateElections(
        req.user,
        franchiseId,
        req.body.elections
      );
    }
    const electionGroup = await electionGroups.updateById(id, req.body);
    if (!electionGroup) {
      return res.status(404).json({ success: false, message: "Election Group not found." });
    }
    await logAuditFromReq(req, "Updated", electionGroup.name, "Election Group", electionGroup._id || electionGroup.id);
    res.status(200).json({ success: true, data: electionGroup });
  } catch (err) {
    sendError(res, err);
  }
};

exports.deleteElectionGroup = async (req, res) => {
  try {
    const { id } = req.query;
    const existing = await electionGroups.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Election Group not found." });
    }
    assertElectionGroupAccess(req.user, existing);
    const electionGroup = await electionGroups.deleteById(id);
    if (!electionGroup) {
      return res.status(404).json({ success: false, message: "Election Group not found." });
    }
    await logAuditFromReq(req, "Deleted", electionGroup.name, "Election Group", electionGroup._id || electionGroup.id);
    res.status(200).json({ success: true, message: "Election Group deleted." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.toString() });
  }
};
