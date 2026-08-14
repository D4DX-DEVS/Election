const voterGroups = require("../lib/supabase/voterGroups");
const users = require("../lib/supabase/users");
const bcrypt = require("bcryptjs");
const roles = require("../lib/roles");
const { logUserActivity, logAuditFromReq } = require("../utils/auditLog");
const { resolveShuffledPrefix } = require("../lib/prefixShuffle");
const { encryptCredential } = require("../lib/credentialVault");
const { sameFranchise } = require("../lib/roles");
const elections = require("../lib/elections");
const {
  requireFranchiseId,
  resourceFranchiseId,
  assertElectionIdsScoped,
  assertUserIdsScoped,
} = require("../lib/tenantScope");

function isValidNameField(value) {
  const trimmed = String(value || "").trim();
  return trimmed.length > 0 && /[a-zA-Z]/.test(trimmed);
}

function sendError(res, err) {
  if (!err.statusCode) console.error(err);
  return res
    .status(err.statusCode || 500)
    .json({ success: false, message: err.message || err.toString() });
}

function generateVoterPassword(prefix) {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  const prefixPart = String(prefix || "").toLowerCase().replace(/[^a-z]/g, "").slice(0, 4);
  let suffix = "";
  for (let i = 0; i < 4; i++) suffix += letters[Math.floor(Math.random() * letters.length)];
  return prefixPart + suffix;
}

function resolveGroupFranchiseId(group) {
  if (!group?.franchiseId) return "";
  const src = group.franchiseId;
  if (typeof src === "object" && src !== null) {
    return String(src._id || src.id || "");
  }
  return String(src);
}

function assertGroupAccess(user, group) {
  if (!group) return;
  if (user?.role === "super_admin") return;
  if (!sameFranchise(user?.franchiseId, resolveGroupFranchiseId(group))) {
    const err = new Error("You are not allowed to access this voter group.");
    err.statusCode = 403;
    throw err;
  }
}

async function validateGroupRelations(actor, franchiseId, body) {
  if (body.elections !== undefined) {
    body.elections = await assertElectionIdsScoped({
      actor,
      franchiseId,
      electionIds: body.elections || [],
      findElectionById: elections.findById,
    });
  }
  if (body.voters !== undefined) {
    body.voters = await assertUserIdsScoped({
      actor,
      franchiseId,
      userIds: body.voters || [],
      findUserById: (id) => users.findById(id, { includePassword: false }),
    });
  }
}

exports.addVoterGroup = async (req, res) => {
  try {
    req.body.franchiseId = requireFranchiseId(
      roles.resolveFranchiseIdForActor(req.user, req.body.franchiseId)
    );
    if (!isValidNameField(req.body.name)) {
      return res.status(400).json({
        success: false,
        message: "Voter group name cannot be numbers only.",
      });
    }
    const dup = await voterGroups.findByName(req.body.franchiseId, req.body.name);
    if (dup) {
      return res.status(409).json({ success: false, message: "A voter group with this name already exists." });
    }
    await validateGroupRelations(req.user, req.body.franchiseId, req.body);
    if (req.body.voters?.length) {
      const conflicts = await voterGroups.findConflictingGroupMemberships(req.body.voters, req.body.franchiseId);
      if (conflicts.length) {
        return res.status(409).json({
          success: false,
          message: `Some voters already belong to another group in this franchise: ${[...new Set(conflicts.map((c) => c.groupName))].join(", ")}.`,
        });
      }
    }
    const voterGroup = await voterGroups.create(req.body);
    await voterGroups.syncGroupVotersAccess(voterGroup);
    await logUserActivity(req.user._id, req.ip, "Created", voterGroup.name, "Voter Group");
    res.status(201).json({ success: true, message: "Voter Group created.", voterGroup });
  } catch (err) {
    sendError(res, err);
  }
};

exports.getVoterGroupById = async (req, res) => {
  try {
    const vg = await voterGroups.findById(req.params.id, {
      populateElections: true,
      populateVoters: true,
    });
    if (!vg) return res.status(404).json({ success: false, message: "Voter Group not found." });
    assertGroupAccess(req.user, vg);
    res.status(200).json({ success: true, data: vg });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.toString() });
  }
};

exports.updateVoterGroupById = async (req, res) => {
  try {
    const existing = await voterGroups.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Voter Group not found." });
    assertGroupAccess(req.user, existing);
    const franchiseId = requireFranchiseId(resolveGroupFranchiseId(existing));
    if (req.body.franchiseId && !sameFranchise(req.body.franchiseId, franchiseId)) {
      const err = new Error("A voter group's organization cannot be changed.");
      err.statusCode = 400;
      throw err;
    }
    delete req.body.franchiseId;
    if (req.body.name !== undefined) {
      if (!isValidNameField(req.body.name)) {
        return res.status(400).json({
          success: false,
          message: "Voter group name cannot be numbers only.",
        });
      }
      const dup = await voterGroups.findByName(franchiseId, req.body.name, req.params.id);
      if (dup) {
        return res.status(409).json({ success: false, message: "A voter group with this name already exists." });
      }
    }
    await validateGroupRelations(req.user, franchiseId, req.body);
    if (req.body.voters?.length) {
      const conflicts = await voterGroups.findConflictingGroupMemberships(req.body.voters, franchiseId, req.params.id);
      if (conflicts.length) {
        return res.status(409).json({
          success: false,
          message: `Some voters already belong to another group in this franchise: ${[...new Set(conflicts.map((c) => c.groupName))].join(", ")}.`,
        });
      }
    }
    const vg = await voterGroups.updateById(req.params.id, req.body);
    if (!vg) return res.status(404).json({ success: false, message: "Voter Group not found." });
    await voterGroups.syncGroupVotersAccess(vg);
    await logAuditFromReq(req, "Updated", vg.name, "Voter Group", vg._id || vg.id);
    res.status(200).json({ success: true, data: vg });
  } catch (err) {
    sendError(res, err);
  }
};

exports.addVotersToGroup = async (req, res) => {
  try {
    const { voterIds } = req.body;
    if (!Array.isArray(voterIds) || voterIds.length === 0) {
      return res.status(400).json({ success: false, message: "voterIds must be a non-empty array." });
    }
    const existing = await voterGroups.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Voter Group not found." });
    assertGroupAccess(req.user, existing);
    const franchiseId = resolveGroupFranchiseId(existing);
    const scopedIds = await assertUserIdsScoped({
      actor: req.user,
      franchiseId,
      userIds: voterIds,
      findUserById: (id) => users.findById(id, { includePassword: false }),
    });

    const conflicts = await voterGroups.findConflictingGroupMemberships(scopedIds, franchiseId, req.params.id);
    if (conflicts.length) {
      return res.status(409).json({
        success: false,
        message: `Some voters already belong to another group in this franchise: ${[...new Set(conflicts.map((c) => c.groupName))].join(", ")}.`,
      });
    }

    const vg = await voterGroups.addVotersToGroup(req.params.id, scopedIds);
    if (!vg) return res.status(404).json({ success: false, message: "Voter Group not found." });
    await logUserActivity(req.user._id, req.ip, "Added voters to", vg.name, "Voter Group");
    res.status(200).json({ success: true, data: vg });
  } catch (err) {
    sendError(res, err);
  }
};

exports.removeVotersFromGroup = async (req, res) => {
  try {
    const { voterIds } = req.body;
    if (!Array.isArray(voterIds) || voterIds.length === 0) {
      return res.status(400).json({ success: false, message: "voterIds must be a non-empty array." });
    }
    const existing = await voterGroups.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Voter Group not found." });
    assertGroupAccess(req.user, existing);

    const vg = await voterGroups.removeVotersFromGroup(req.params.id, voterIds);
    if (!vg) return res.status(404).json({ success: false, message: "Voter Group not found." });
    await logUserActivity(req.user._id, req.ip, "Removed voters from", vg.name, "Voter Group");
    res.status(200).json({ success: true, data: vg });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.toString() });
  }
};

exports.deleteVoterGroupById = async (req, res) => {
  try {
    const existing = await voterGroups.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Voter Group not found." });
    assertGroupAccess(req.user, existing);
    const vg = await voterGroups.deleteById(req.params.id);
    if (!vg) return res.status(404).json({ success: false, message: "Voter Group not found." });
    await logAuditFromReq(req, "Deleted", vg.name, "Voter Group", vg._id || vg.id);
    res.status(200).json({ success: true, message: "Voter Group deleted." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.toString() });
  }
};

exports.getVoterGroups = async (req, res) => {
  try {
    const scopedFranchiseId =
      req.user?.role === "super_admin" ? undefined : req.user?.franchiseId;

    if (req.query.page !== undefined) {
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limit = Math.max(parseInt(req.query.limit || req.query.pageSize, 10) || 10, 1);
      const { groups: paged, total } = await voterGroups.findAll({
        page,
        limit,
        populateElections: true,
        franchiseId: scopedFranchiseId,
      });
      const totalPages = Math.max(Math.ceil(total / limit), 1);
      return res.status(200).json({
        success: true,
        count: paged.length,
        pagination: { total, page, pageSize: limit, totalPages },
        data: paged,
      });
    }

    const { groups: voterGroupsList } = await voterGroups.findAll({
      populateElections: true,
      franchiseId: scopedFranchiseId,
    });
    res.status(200).json({ success: true, count: voterGroupsList.length, data: voterGroupsList });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.toString() });
  }
};

exports.assignElections = async (req, res) => {
  try {
    const existing = await voterGroups.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "Voter Group not found." });
    assertGroupAccess(req.user, existing);
    const { electionIds } = req.body;
    const scopedElectionIds = await assertElectionIdsScoped({
      actor: req.user,
      franchiseId: resolveGroupFranchiseId(existing),
      electionIds: electionIds || [],
      findElectionById: elections.findById,
    });
    const group = await voterGroups.updateById(req.params.id, { elections: scopedElectionIds });
    if (!group) return res.status(404).json({ success: false, message: "Voter Group not found." });
    await voterGroups.syncGroupVotersAccess(group);
    await logAuditFromReq(req, "Assigned elections to", group.name, "Voter Group", group._id || group.id);
    res.status(200).json({ success: true, data: group });
  } catch (err) {
    sendError(res, err);
  }
};

exports.getGroupVoters = async (req, res) => {
  try {
    const group = await voterGroups.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: "Voter Group not found." });
    assertGroupAccess(req.user, group);

    if (req.query.page !== undefined) {
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limit = Math.max(parseInt(req.query.limit || req.query.pageSize, 10) || 10, 1);
      const { voters, total } = await voterGroups.findGroupVotersPaginated(req.params.id, { page, limit });
      const groupFranchiseId = resolveGroupFranchiseId(group);
      const scopedVoters = voters.filter((voter) =>
        sameFranchise(groupFranchiseId, resourceFranchiseId(voter))
      );
      const safeTotal = scopedVoters.length === voters.length ? total : scopedVoters.length;
      const totalPages = Math.max(Math.ceil(safeTotal / limit), 1);
      return res.status(200).json({
        success: true,
        count: scopedVoters.length,
        pagination: { total: safeTotal, page, pageSize: limit, totalPages },
        data: scopedVoters,
      });
    }

    const fullGroup = await voterGroups.findById(req.params.id, { populateVoters: true });
    const voters = (Array.isArray(fullGroup?.voters) ? fullGroup.voters : []).filter(
      (voter) =>
        typeof voter === "object" &&
        sameFranchise(resolveGroupFranchiseId(group), resourceFranchiseId(voter))
    );
    res.status(200).json({ success: true, count: voters.length, data: voters });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.toString() });
  }
};

exports.addVoterToGroup = async (req, res) => {
  try {
    const group = await voterGroups.findById(req.params.id, { populateElections: true });
    if (!group) return res.status(404).json({ success: false, message: "Voter Group not found." });
    assertGroupAccess(req.user, group);

    const { username, fullName, registrationNumber } = req.body;
    if (!username) return res.status(400).json({ success: false, message: "username is required." });
    if (!isValidNameField(username)) {
      return res.status(400).json({ success: false, message: "Username cannot be numbers only." });
    }
    if (fullName && !isValidNameField(fullName)) {
      return res.status(400).json({ success: false, message: "Full name cannot be numbers only." });
    }

    const existing = await users.findByUsername(String(username).trim());
    if (existing) return res.status(409).json({ success: false, message: "Username already exists." });

    const plainPassword = generateVoterPassword(username);
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    const franchiseId = requireFranchiseId(resolveGroupFranchiseId(group));
    const electionAccess = (group.elections || []).map((e) => (typeof e === "object" ? e._id || e.id : e));

    const voter = await users.create({
      username: String(username).trim(),
      password: hashedPassword,
      credentialCiphertext: encryptCredential(plainPassword),
      fullName: fullName || username,
      registrationNumber: registrationNumber || username,
      role: "voter",
      isVoter: true,
      status: "active",
      franchiseId,
      electionAccess,
    });

    await voterGroups.addVotersToGroup(req.params.id, [voter._id]);

    await logAuditFromReq(req, "Created", voter.username, "Voter", voter._id || voter.id);
    res.status(201).json({
      success: true,
      data: { id: voter._id, username: voter.username, plainPassword },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.toString() });
  }
};

exports.generateVotersInGroup = async (req, res) => {
  try {
    const group = await voterGroups.findById(req.params.id, { populateElections: true });
    if (!group) return res.status(404).json({ success: false, message: "Voter Group not found." });
    assertGroupAccess(req.user, group);

    const shuffledPrefix = resolveShuffledPrefix(null, req.body.shuffledPrefix || req.body.prefix);
    const start = parseInt(req.body.startingNumber, 10) || group.startingNumber || 1001;
    const num = Math.min(parseInt(req.body.count, 10) || 10, 1000);
    const franchiseId = requireFranchiseId(resolveGroupFranchiseId(group));
    const electionAccess = (group.elections || []).map((e) => (typeof e === "object" ? e._id || e.id : e));

    const usernames = [];
    for (let i = 0; i < num; i++) usernames.push(`${shuffledPrefix}${start + i}`);
    const existing = await users.findByUsernames(usernames);
    const existingSet = new Set(existing.map((u) => u.username.toLowerCase()));

    const usedPasswords = new Set();
    const credentialsByUsername = new Map();
    const docs = [];
    for (let i = 0; i < num; i++) {
      const seq = start + i;
      const username = `${shuffledPrefix}${seq}`;
      if (existingSet.has(username.toLowerCase())) continue;
      let plainPassword;
      do {
        plainPassword = generateVoterPassword(shuffledPrefix);
      } while (usedPasswords.has(plainPassword));
      usedPasswords.add(plainPassword);
      credentialsByUsername.set(username, plainPassword);
      const hashedPassword = await bcrypt.hash(plainPassword, 10);
      docs.push({
        username,
        password: hashedPassword,
        credentialCiphertext: encryptCredential(plainPassword),
        fullName: username,
        role: "voter",
        isVoter: true,
        status: "active",
        registrationNumber: username,
        franchiseId,
        electionAccess,
        voterMetadata: { prefix: shuffledPrefix, sequenceNumber: seq },
      });
    }

    if (docs.length === 0) {
      return res.status(409).json({ success: false, message: "All requested usernames already exist." });
    }

    const created = await users.insertMany(docs);
    await voterGroups.addVotersToGroup(
      req.params.id,
      created.map((u) => u._id)
    );

    await logAuditFromReq(
      req,
      "Generated voters in",
      `${group.name} (${created.length} voters)`,
      "Voter Group",
      group._id || group.id
    );

    res.status(201).json({
      success: true,
      count: created.length,
      skipped: num - created.length,
      shuffledPrefix,
      data: created.map((u) => ({
        id: u._id,
        username: u.username,
        plainPassword: credentialsByUsername.get(u.username),
      })),
    });
  } catch (err) {
    console.error(err);
    const status = err.statusCode || 500;
    res.status(status).json({ success: false, message: err.message || err.toString() });
  }
};
