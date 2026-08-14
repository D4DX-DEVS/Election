const users = require("../lib/supabase/users");
const voterGroups = require("../lib/supabase/voterGroups");
const bcrypt = require("bcryptjs");
const { logUserActivity, logAuditFromReq } = require("../utils/auditLog");
const roles = require("../lib/roles");
const { resolveShuffledPrefix } = require("../lib/prefixShuffle");
const { encryptCredential } = require("../lib/credentialVault");
const elections = require("../lib/elections");
const {
  requireFranchiseId,
  resourceFranchiseId,
  assertElectionIdsScoped,
  assertUserIdsScoped,
} = require("../lib/tenantScope");

const generatePassword = (prefix) => {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  const prefixPart = String(prefix || "").toLowerCase().replace(/[^a-z]/g, "").slice(0, 4);
  let suffix = "";
  for (let i = 0; i < 4; i++) suffix += letters[Math.floor(Math.random() * letters.length)];
  return prefixPart + suffix;
};

function isValidNameField(value) {
  const trimmed = String(value || "").trim();
  return trimmed.length > 0 && /[a-zA-Z]/.test(trimmed);
}

function sendError(res, err) {
  if (err.statusCode) {
    return res.status(err.statusCode).json({ success: false, message: err.message });
  }
  console.error(err);
  return res.status(500).json({ success: false, message: err.message || err.toString() });
}

async function assertNoDuplicateUser({ username, email }) {
  const normalized = roles.normalizeUsername(username);
  if (!normalized) {
    const err = new Error("username is required.");
    err.statusCode = 400;
    throw err;
  }
  const existing = await users.findByUsername(normalized);
  if (existing) {
    const err = new Error("Username already exists.");
    err.statusCode = 409;
    throw err;
  }
  if (email && String(email).trim()) {
    const existingEmail = await users.findByEmail(String(email).trim());
    if (existingEmail) {
      const err = new Error("Email already in use.");
      err.statusCode = 409;
      throw err;
    }
  }
  return normalized;
}

async function loadTargetUser(id) {
  const user = await users.findById(id, { includePassword: false });
  if (!user) {
    const err = new Error("User not found.");
    err.statusCode = 404;
    throw err;
  }
  return user;
}

async function validateElectionAssignments(actor, franchiseId, electionIds) {
  return assertElectionIdsScoped({
    actor,
    franchiseId,
    electionIds,
    findElectionById: elections.findById,
  });
}

async function assertVoterGroupScoped(actor, franchiseId, voterGroupId) {
  if (!voterGroupId) return null;
  const group = await voterGroups.findById(voterGroupId);
  if (!group) {
    const err = new Error("Voter group not found.");
    err.statusCode = 404;
    throw err;
  }
  if (!roles.sameFranchise(franchiseId, resourceFranchiseId(group))) {
    const err = new Error("A voter group from another organization cannot be assigned.");
    err.statusCode = 403;
    throw err;
  }
  return group;
}

exports.addUser = async (req, res) => {
  try {
    const targetRole = req.body.role || "voter";
    roles.assertCanAssignRole(req.user, targetRole);

    if (targetRole === "franchise_admin" && req.user.role !== "super_admin") {
      const err = new Error("Only super admin can create franchise admins.");
      err.statusCode = 403;
      throw err;
    }

    const username = await assertNoDuplicateUser({
      username: req.body.username,
      email: req.body.email,
    });

    const franchiseId = roles.resolveFranchiseIdForActor(req.user, req.body.franchiseId);
    if (targetRole !== "super_admin") requireFranchiseId(franchiseId);
    const electionAccess =
      targetRole === "super_admin"
        ? []
        : await validateElectionAssignments(
            req.user,
            franchiseId,
            req.body.electionAccess || []
          );

    const user = await users.create({
      ...req.body,
      username,
      role: targetRole,
      franchiseId,
      electionAccess,
    });
    await logUserActivity(req.user._id, req.ip, "Created", user.username, "User");
    res.status(201).json({ success: true, message: "User created.", user: users.stripPassword(user) });
  } catch (err) {
    sendError(res, err);
  }
};

exports.getUsers = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === "franchise_admin") {
      filter.franchiseId = req.user.franchiseId;
    } else if (req.user.role === "election_admin") {
      filter.role = "voter";
      if (req.user.franchiseId) filter.franchiseId = req.user.franchiseId;
    }

    let data = await users.findAll(filter);
    data = roles.filterUsersForActor(req.user, data).map(users.stripPassword);
    res.status(200).json({ success: true, data });
  } catch (err) {
    sendError(res, err);
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await loadTargetUser(id);
    roles.assertCanManageUser(req.user, existing);

    if (req.body.role && req.body.role !== existing.role) {
      roles.assertCanAssignRole(req.user, req.body.role);
      roles.assertCanManageUser(req.user, { ...existing, role: req.body.role });
    }

    if (req.body.username) {
      const normalized = roles.normalizeUsername(req.body.username);
      if (normalized.toLowerCase() !== existing.username.toLowerCase()) {
        const dup = await users.findByUsername(normalized);
        if (dup) {
          return res.status(409).json({ success: false, message: "Username already exists." });
        }
      }
      req.body.username = normalized;
    }

    if (req.body.email && String(req.body.email).trim()) {
      const normalizedEmail = String(req.body.email).trim();
      if ((existing.email || "").toLowerCase() !== normalizedEmail.toLowerCase()) {
        const dupEmail = await users.findByEmail(normalizedEmail);
        if (dupEmail) {
          return res.status(409).json({ success: false, message: "Email already in use." });
        }
      }
    }

    if (req.body.franchiseId && !roles.sameFranchise(req.body.franchiseId, existing.franchiseId)) {
      const err = new Error("A user's organization cannot be changed after creation.");
      err.statusCode = 400;
      throw err;
    }
    delete req.body.franchiseId;

    if (req.user.role !== "super_admin") {
      if (req.user.role === "election_admin") {
        delete req.body.role;
        delete req.body.electionAccess;
      }
    }

    const finalRole = req.body.role || existing.role;
    if (finalRole !== "super_admin") {
      requireFranchiseId(existing.franchiseId);
      if (req.body.electionAccess !== undefined) {
        req.body.electionAccess = await validateElectionAssignments(
          req.user,
          existing.franchiseId,
          req.body.electionAccess
        );
      }
    }

    const user = await users.updateById(id, req.body);
    await logUserActivity(req.user._id, req.ip, "Updated", user.username, "User");
    res.status(200).json({ success: true, data: users.stripPassword(user) });
  } catch (err) {
    sendError(res, err);
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const id = req.params.id || req.query.id;
    const existing = await loadTargetUser(id);
    roles.assertCanManageUser(req.user, existing);

    const user = await users.deleteById(id);
    await logUserActivity(req.user._id, req.ip, "Deleted", user.username, "User");
    res.status(200).json({ success: true, message: "User deleted." });
  } catch (err) {
    sendError(res, err);
  }
};

exports.getUserById = async (req, res) => {
  try {
    const user = await loadTargetUser(req.params.id);
    if (!roles.canManageUser(req.user, user) && String(req.user._id) !== String(user._id)) {
      return res.status(403).json({ success: false, message: "You are not allowed to view this user." });
    }
    res.status(200).json({ success: true, data: users.stripPassword(user) });
  } catch (err) {
    sendError(res, err);
  }
};

exports.getFranchiseAdmins = async (req, res) => {
  try {
    if (req.user.role === "election_admin") {
      return res.status(403).json({
        success: false,
        message: "Election admins cannot list franchise admins.",
      });
    }

    const filter = { role: "franchise_admin" };
    if (req.user.role === "franchise_admin") {
      filter.franchiseId = req.user.franchiseId;
    } else if (req.query.franchiseId) {
      filter.franchiseId = req.query.franchiseId;
    }

    if (req.query.page !== undefined) {
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limit = Math.max(parseInt(req.query.limit || req.query.pageSize, 10) || 10, 1);
      const { users: franchiseAdmins, total } = await users.findPaginated(filter, { page, limit });
      const withFranchises = await users.attachFranchiseDetails(franchiseAdmins);
      const data = withFranchises.map(users.stripPassword);
      const totalPages = Math.max(Math.ceil(total / limit), 1);
      return res.status(200).json({
        success: true,
        count: data.length,
        pagination: { total, page, pageSize: limit, totalPages },
        data,
      });
    }

    const franchiseAdmins = await users.findAll(filter);
    const withFranchises = await users.attachFranchiseDetails(franchiseAdmins);
    const data = withFranchises.map(users.stripPassword);
    res.status(200).json({ success: true, count: data.length, data });
  } catch (err) {
    sendError(res, err);
  }
};

exports.getElectionAdmins = async (req, res) => {
  try {
    if (req.user.role !== "franchise_admin") {
      return res.status(403).json({
        success: false,
        message: "Only franchise admins can list election admins.",
      });
    }

    const filter = { role: "election_admin", franchiseId: req.user.franchiseId };

    if (req.query.page !== undefined) {
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limit = Math.max(parseInt(req.query.limit || req.query.pageSize, 10) || 10, 1);
      const { users: electionAdmins, total } = await users.findPaginated(filter, { page, limit });
      const withFranchises = await users.attachFranchiseDetails(electionAdmins);
      const data = withFranchises.map(users.stripPassword);
      const totalPages = Math.max(Math.ceil(total / limit), 1);
      return res.status(200).json({
        success: true,
        count: data.length,
        pagination: { total, page, pageSize: limit, totalPages },
        data,
      });
    }

    const electionAdmins = await users.findAll(filter);
    const withFranchises = await users.attachFranchiseDetails(electionAdmins);
    const data = withFranchises.map(users.stripPassword);
    res.status(200).json({ success: true, count: data.length, data });
  } catch (err) {
    sendError(res, err);
  }
};

exports.getAllVoters = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = parseInt(req.query.pageSize, 10) || 10;

    const voterQuery = {
      page,
      pageSize,
      status: req.query.status,
      search: req.query.search,
      electionId: req.query.electionId,
      notInElection: req.query.notInElection,
      notInGroup: req.query.notInGroup,
      forElectionId: req.query.forElectionId,
    };

    if (req.user.role === "franchise_admin" || req.user.role === "election_admin") {
      voterQuery.franchiseId = req.user.franchiseId;
    }

    const { voters, total } = await users.getAllVoters(voterQuery);

    const scoped =
      req.user.role === "election_admin"
        ? roles.filterUsersForActor(req.user, voters)
        : voters;

    res.status(200).json({
      success: true,
      pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) },
      data: scoped,
    });
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ success: false, message: err.message });
    }
    sendError(res, err);
  }
};

exports.createVoter = async (req, res) => {
  try {
    roles.assertCanAssignRole(req.user, "voter");

    if (!isValidNameField(req.body.username)) {
      return res.status(400).json({ success: false, message: "Username cannot be numbers only." });
    }
    if (req.body.fullName && !isValidNameField(req.body.fullName)) {
      return res.status(400).json({ success: false, message: "Full name cannot be numbers only." });
    }

    const username = await assertNoDuplicateUser({ username: req.body.username });

    const plainPassword =
      req.body.password && String(req.body.password).trim()
        ? String(req.body.password).trim()
        : generatePassword(username);
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    const franchiseId = requireFranchiseId(
      roles.resolveFranchiseIdForActor(req.user, req.body.franchiseId)
    );
    const { electionIds } = req.body;
    const requestedElectionAccess = Array.isArray(electionIds)
      ? electionIds
      : electionIds
      ? [electionIds]
      : [];
    const electionAccess = await validateElectionAssignments(
      req.user,
      franchiseId,
      requestedElectionAccess
    );
    await assertVoterGroupScoped(req.user, franchiseId, req.body.voterGroupId);

    const user = await users.create({
      username,
      password: hashedPassword,
      credentialCiphertext: encryptCredential(plainPassword),
      fullName: req.body.fullName || username,
      role: "voter",
      isVoter: true,
      status: "active",
      registrationNumber: req.body.registrationNumber || username,
      franchiseId,
      electionAccess,
    });

    const voterGroupId = req.body.voterGroupId;
    if (voterGroupId) {
      await voterGroups.addVotersToGroup(voterGroupId, [user._id]);
    }

    await logUserActivity(req.user._id, req.ip, "Created", user.username, "Voter");
    res.status(201).json({
      success: true,
      message: "Voter created.",
      data: { id: user._id, username: user.username, password: plainPassword },
    });
  } catch (err) {
    sendError(res, err);
  }
};

function generateRandomPassword(length = 8) {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

exports.generateVoters = async (req, res) => {
  try {
    roles.assertCanAssignRole(req.user, "voter");

    const { prefix, startingNumber, count, electionIds, voterGroupId, assignmentType, shuffledPrefix: clientShuffled } = req.body;

    let shuffledPrefix;
    try {
      shuffledPrefix = resolveShuffledPrefix(null, clientShuffled || prefix);
    } catch (err) {
      return sendError(res, err);
    }
    const start = parseInt(startingNumber, 10);
    const num = parseInt(count, 10);
    if (Number.isNaN(start) || start < 0) {
      return res.status(400).json({ success: false, message: "startingNumber must be a non-negative number." });
    }
    if (Number.isNaN(num) || num < 1 || num > 1000) {
      return res.status(400).json({ success: false, message: "count must be between 1 and 1000." });
    }

    const requestedElectionAccess =
      assignmentType === "election" && Array.isArray(electionIds) ? electionIds : [];

    const usernames = [];
    for (let i = 0; i < num; i++) usernames.push(`${shuffledPrefix}${start + i}`);

    const existing = await users.findByUsernames(usernames);
    const existingLower = new Set(existing.map((u) => u.username.toLowerCase()));

    const franchiseId = requireFranchiseId(
      roles.resolveFranchiseIdForActor(req.user, req.body.franchiseId)
    );
    const electionAccess = await validateElectionAssignments(
      req.user,
      franchiseId,
      requestedElectionAccess
    );
    await assertVoterGroupScoped(req.user, franchiseId, voterGroupId);

    const usedPasswords = new Set();
    const credentialsByUsername = new Map();
    const docs = [];
    for (let i = 0; i < num; i++) {
      const seq = start + i;
      const username = `${shuffledPrefix}${seq}`;
      if (existingLower.has(username.toLowerCase())) continue;
      let plainPassword;
      do {
        plainPassword = generatePassword(shuffledPrefix);
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
        voterMetadata: {
          prefix: shuffledPrefix,
          sequenceNumber: seq,
        },
      });
    }

    if (docs.length === 0) {
      return res.status(409).json({
        success: false,
        message: "All requested voter usernames already exist.",
      });
    }

    const created = await users.insertMany(docs);

    if (voterGroupId) {
      await voterGroups.addVotersToGroup(voterGroupId, created.map((u) => u._id));
    }

    await logAuditFromReq(
      req,
      "Generated",
      `${created.length} voters`,
      "Voter",
      voterGroupId || null
    );

    res.status(201).json({
      success: true,
      message: `Generated ${created.length} voter accounts.`,
      count: created.length,
      skipped: num - created.length,
      data: created.map((u) => ({
        id: u._id,
        username: u.username,
        plainPassword: credentialsByUsername.get(u.username),
      })),
    });
  } catch (err) {
    sendError(res, err);
  }
};

exports.createFranchiseAdmin = async (req, res) => {
  try {
    if (req.user.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Only super admin can create franchise admins.",
      });
    }

    const { password, fullName, franchiseId } = req.body;
    if (!isValidNameField(req.body.username)) {
      return res.status(400).json({ success: false, message: "Username cannot be numbers only." });
    }
    if (fullName && !isValidNameField(fullName)) {
      return res.status(400).json({ success: false, message: "Full name cannot be numbers only." });
    }
    const username = await assertNoDuplicateUser({ username: req.body.username, email: req.body.email });

    if (!franchiseId) {
      return res.status(400).json({ success: false, message: "franchiseId is required." });
    }
    if (!password) {
      return res.status(400).json({ success: false, message: "password is required." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await users.create({
      username,
      password: hashedPassword,
      fullName,
      franchiseId,
      role: "franchise_admin",
      status: "active",
    });
    await logAuditFromReq(req, "Created", user.username, "Franchise Admin", user._id || user.id);
    res.status(201).json({
      success: true,
      message: "Franchise admin created.",
      data: { id: user._id, username: user.username, role: user.role },
    });
  } catch (err) {
    sendError(res, err);
  }
};

exports.createElectionAdmin = async (req, res) => {
  try {
    if (req.user.role !== "franchise_admin") {
      return res.status(403).json({
        success: false,
        message: "Only a franchise admin can create election admins.",
      });
    }

    const { password, fullName, electionAccess } = req.body;
    if (!isValidNameField(req.body.username)) {
      return res.status(400).json({ success: false, message: "Username cannot be numbers only." });
    }
    if (fullName && !isValidNameField(fullName)) {
      return res.status(400).json({ success: false, message: "Full name cannot be numbers only." });
    }
    const username = await assertNoDuplicateUser({ username: req.body.username, email: req.body.email });
    const franchiseId = requireFranchiseId(
      roles.resolveFranchiseIdForActor(req.user, req.body.franchiseId)
    );

    if (!franchiseId) {
      return res.status(400).json({ success: false, message: "franchiseId is required." });
    }
    if (!password) {
      return res.status(400).json({ success: false, message: "password is required." });
    }
    const scopedElectionAccess = await validateElectionAssignments(
      req.user,
      franchiseId,
      electionAccess || []
    );

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await users.create({
      username,
      password: hashedPassword,
      fullName,
      franchiseId,
      electionAccess: scopedElectionAccess,
      role: "election_admin",
      status: "active",
    });
    await logAuditFromReq(req, "Created", user.username, "Election Admin", user._id || user.id);
    res.status(201).json({
      success: true,
      message: "Election admin created.",
      data: { id: user._id, username: user.username, role: user.role },
    });
  } catch (err) {
    sendError(res, err);
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const existing = await loadTargetUser(req.params.id);
    roles.assertCanManageUser(req.user, existing);

    const { newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ success: false, message: "newPassword is required." });
    const withPassword = await users.findById(req.params.id, { includePassword: true });
    const isSamePassword = await bcrypt.compare(String(newPassword), withPassword.password);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from the current password.",
      });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await users.updateById(req.params.id, {
      password: hashedPassword,
      ...(existing.role === "voter"
        ? { credentialCiphertext: encryptCredential(newPassword) }
        : {}),
    });
    await logAuditFromReq(req, "Reset password for", existing.username, "User", existing._id || existing.id);
    res.status(200).json({ success: true, message: "Password reset successfully." });
  } catch (err) {
    sendError(res, err);
  }
};

exports.getVoterCredentials = async (req, res) => {
  try {
    const voterIds = [...new Set((req.body.voterIds || []).map(String))];
    if (!voterIds.length || voterIds.length > 1000) {
      return res.status(400).json({
        success: false,
        message: "Provide between 1 and 1000 voter IDs.",
      });
    }

    const voters = await users.findByIds(voterIds, { includePassword: false });
    if (voters.length !== voterIds.length) {
      return res.status(404).json({ success: false, message: "One or more voters were not found." });
    }
    if (voters.some((v) => v.role !== "voter")) {
      return res.status(400).json({
        success: false,
        message: "Credentials are available only for voters.",
      });
    }
    voters.forEach((voter) => roles.assertCanManageUser(req.user, voter));

    const credentialById = await users.getPrintableCredentials(voterIds);
    const data = voters.map((voter) => ({
      id: voter._id || voter.id,
      username: voter.username,
      plainPassword: credentialById.get(String(voter._id || voter.id)) || null,
      sequenceNumber: voter.voterMetadata?.sequenceNumber || null,
      electionAccess: voter.electionAccess || [],
    }));

    await logAuditFromReq(
      req,
      "Printed credentials for",
      `${data.length} voter(s)`,
      "Voter Credentials"
    );
    res.status(200).json({ success: true, count: data.length, data });
  } catch (err) {
    sendError(res, err);
  }
};
