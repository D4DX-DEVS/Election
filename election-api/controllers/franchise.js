const franchises = require("../lib/supabase/franchises");
const { logAuditFromReq } = require("../utils/auditLog");
const { sameFranchise } = require("../lib/roles");

function assertFranchiseAccess(actor, franchise) {
  if (!franchise) return;
  if (actor.role === "super_admin") return;
  if (!sameFranchise(actor.franchiseId, franchise._id || franchise.id)) {
    const err = new Error("You are not allowed to access this franchise.");
    err.statusCode = 403;
    throw err;
  }
}

function sendError(res, err) {
  if (err.statusCode) {
    return res.status(err.statusCode).json({ success: false, message: err.message });
  }
  console.error(err);
  return res.status(500).json({ success: false, message: err.message || err.toString() });
}

exports.getFranchiseById = async (req, res) => {
  try {
    const franchise = await franchises.findById(req.params.id);
    if (!franchise) return res.status(404).json({ success: false, message: "Franchise not found." });
    assertFranchiseAccess(req.user, franchise);
    res.status(200).json({ success: true, data: franchise });
  } catch (err) {
    sendError(res, err);
  }
};

exports.updateFranchiseById = async (req, res) => {
  try {
    const existing = await franchises.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Franchise not found." });
    assertFranchiseAccess(req.user, existing);

    normalizeFranchiseBody(req);
    if (req.file?.cdnUrl) {
      req.body.logo = { url: req.file.cdnUrl, alt: req.body.name };
    }
    const franchise = await franchises.updateById(req.params.id, req.body);
    await logAuditFromReq(req, "Updated", franchise.name, "Franchise", franchise._id || franchise.id);
    res.status(200).json({ success: true, data: franchise });
  } catch (err) {
    sendError(res, err);
  }
};

function cascadeAuditLabel(cascade) {
  if (!cascade) return "";
  const parts = [];
  if (cascade.elections) parts.push(`${cascade.elections} election(s)`);
  if (cascade.users) parts.push(`${cascade.users} user(s)`);
  if (cascade.voterGroups) parts.push(`${cascade.voterGroups} voter group(s)`);
  if (cascade.electionGroups) parts.push(`${cascade.electionGroups} election group(s)`);
  return parts.length ? ` (+ ${parts.join(", ")})` : "";
}

exports.deleteFranchiseById = async (req, res) => {
  try {
    // Block deleting a franchise that is still in use — its admin must clear the
    // data first. Only an empty (effectively unused) franchise can be removed.
    const counts = await franchises.getFranchiseDataCounts(req.params.id);
    const inUse = counts.elections + counts.voters + counts.voterGroups + counts.electionGroups;
    if (inUse > 0) {
      const parts = [];
      if (counts.elections) parts.push(`${counts.elections} election(s)`);
      if (counts.voters) parts.push(`${counts.voters} voter(s)`);
      if (counts.voterGroups) parts.push(`${counts.voterGroups} voter group(s)`);
      if (counts.electionGroups) parts.push(`${counts.electionGroups} election group(s)`);
      return res.status(409).json({
        success: false,
        message: `This franchise still has ${parts.join(", ")}. The franchise admin must delete this data before the franchise can be removed.`,
      });
    }

    const result = await franchises.deleteById(req.params.id);
    if (!result) return res.status(404).json({ success: false, message: "Franchise not found." });
    const { franchise, cascadeDeleted } = result;
    await logAuditFromReq(
      req,
      "Deleted",
      `${franchise.name}${cascadeAuditLabel(cascadeDeleted)}`,
      "Franchise",
      franchise._id || franchise.id
    );
    res.status(200).json({ success: true, message: "Franchise deleted." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.toString() });
  }
};

function normalizeFranchiseBody(req) {
  const body = req.body || {};
  if (body.website_url !== undefined && body.websiteUrl === undefined) {
    body.websiteUrl = body.website_url;
  }
  if (body.contact_number !== undefined && body.contactNumber === undefined) {
    body.contactNumber = body.contact_number;
  }
  return body;
}

exports.addFranchise = async (req, res) => {
  try {
    normalizeFranchiseBody(req);
    const existingFranchise = await franchises.findByName(req.body.name);
    if (existingFranchise) {
      return res.status(409).json({ success: false, message: "Franchise already exists." });
    }
    if (req.file?.cdnUrl) {
      req.body.logo = { url: req.file.cdnUrl, alt: req.body.name };
    }
    const franchise = await franchises.create(req.body);
    await logAuditFromReq(req, "Created", franchise.name, "Franchise", franchise._id || franchise.id);
    res.status(201).json({ success: true, message: "Franchise created.", franchise });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.toString() });
  }
};

exports.getFranchises = async (req, res) => {
  try {
    const scopedFranchiseId =
      req.user.role === "super_admin" ? undefined : req.user.franchiseId;

    if (req.query.page !== undefined) {
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limit = Math.max(parseInt(req.query.limit || req.query.pageSize, 10) || 10, 1);
      const { franchises: paged, total } = await franchises.findAll({ page, limit, franchiseId: scopedFranchiseId });
      const totalPages = Math.max(Math.ceil(total / limit), 1);
      return res.status(200).json({
        success: true,
        count: paged.length,
        pagination: { total, page, pageSize: limit, totalPages },
        data: paged,
      });
    }

    const { franchises: data } = await franchises.findAll({ franchiseId: scopedFranchiseId });
    res.status(200).json({ success: true, data });
  } catch (err) {
    sendError(res, err);
  }
};

exports.updateFranchise = async (req, res) => {
  try {
    const { id } = req.body;
    const existing = await franchises.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Franchise not found." });
    }
    assertFranchiseAccess(req.user, existing);
    normalizeFranchiseBody(req);
    const franchise = await franchises.updateById(id, req.body);
    if (!franchise) {
      return res.status(404).json({ success: false, message: "Franchise not found." });
    }
    await logAuditFromReq(req, "Updated", franchise.name, "Franchise", franchise._id || franchise.id);
    res.status(200).json({ success: true, data: franchise });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.toString() });
  }
};

exports.deleteFranchise = async (req, res) => {
  try {
    const { id } = req.query;
    const existing = await franchises.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Franchise not found." });
    }
    assertFranchiseAccess(req.user, existing);
    const result = await franchises.deleteById(id);
    if (!result) {
      return res.status(404).json({ success: false, message: "Franchise not found." });
    }
    const { franchise, cascadeDeleted } = result;
    await logAuditFromReq(
      req,
      "Deleted",
      `${franchise.name}${cascadeAuditLabel(cascadeDeleted)}`,
      "Franchise",
      franchise._id || franchise.id
    );
    res.status(200).json({ success: true, message: "Franchise deleted." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.toString() });
  }
};
