const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const users = require("../lib/supabase/users");
const roles = require("../lib/roles");
const { logUserActivity } = require("../utils/auditLog");

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "24h" });
};

function stripUser(user) {
  return users.stripPassword(user);
}

exports.login = async (req, res) => {
  try {
    const username = roles.normalizeUsername(req.body.username);
    const password = String(req.body.password || "");

    if (!username || !password) {
      return res.status(400).json({ success: false, message: "Please provide username and password" });
    }

    const user = await users.findByUsername(username);

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    if (user.status === "inactive") {
      return res.status(401).json({ success: false, message: "Account is inactive" });
    }

    let isMatch = false;
    try {
      isMatch = await bcrypt.compare(password, user.password);
    } catch {
      isMatch = password === user.password;
    }
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const previousLogin = user.lastLogin || null;

    await users.updateById(user._id, { lastLogin: new Date().toISOString() });

    const token = generateToken(user._id.toString());

    await logUserActivity(user._id, req.ip, "Logged in", user.username, "Auth", user._id);

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        email: user.email,
        fullName: user.fullName,
        franchiseId: user.franchiseId,
        isVoter: user.isVoter,
        onboardingCompleted: user.onboardingCompleted,
        status: user.status,
        lastLogin: previousLogin,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.toString() });
  }
};

exports.getCurrentUser = async (req, res) => {
  try {
    const user = await users.findById(req.user._id, { includePassword: false });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.status(200).json({ success: true, user: stripUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.toString() });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const existing = await users.findById(userId, { includePassword: false });
    if (!existing) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const updates = {};
    if (req.body.fullName !== undefined) {
      const fullName = String(req.body.fullName).trim();
      if (!fullName) {
        return res.status(400).json({ success: false, message: "Full name cannot be empty." });
      }
      updates.fullName = fullName;
    }

    if (req.body.email !== undefined) {
      const email = String(req.body.email).trim();
      if (email) {
        const dup = await users.findByEmail(email);
        if (dup && String(dup._id) !== String(userId)) {
          return res.status(409).json({ success: false, message: "Email already in use." });
        }
        updates.email = email;
      } else {
        updates.email = null;
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: "No valid fields to update." });
    }

    const user = await users.updateById(userId, updates);
    await logUserActivity(userId, req.ip, "Updated profile", user.username, "User", userId);
    res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      user: stripUser(user),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.toString() });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required.",
      });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters.",
      });
    }

    const userId = req.user._id || req.user.id;
    const user = await users.findById(userId, { includePassword: true });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    let isMatch = false;
    try {
      isMatch = await bcrypt.compare(String(currentPassword), user.password);
    } catch {
      isMatch = String(currentPassword) === user.password;
    }
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Current password is incorrect." });
    }

    const hashedPassword = await bcrypt.hash(String(newPassword), 10);
    // User set this themselves, so admins should no longer see it in plaintext.
    await users.updateById(userId, { password: hashedPassword, plainPassword: null });

    await logUserActivity(userId, req.ip, "Changed password", user.username, "User", userId);

    res.status(200).json({ success: true, message: "Password changed successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.toString() });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { username, email, newPassword } = req.body;

    if (!username || !String(username).trim()) {
      return res.status(400).json({ success: false, message: "Username is required." });
    }
    if (!email || !String(email).trim()) {
      return res.status(400).json({ success: false, message: "Email is required." });
    }
    if (!newPassword || String(newPassword).length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters.",
      });
    }

    const user = await users.findByUsername(String(username).trim());
    const normalizedEmail = String(email).trim().toLowerCase();

    if (
      !user ||
      user.status === "inactive" ||
      !user.email ||
      String(user.email).trim().toLowerCase() !== normalizedEmail
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Username and email do not match our records. Add your email in Profile first, or contact your administrator.",
      });
    }

    const hashedPassword = await bcrypt.hash(String(newPassword), 10);
    // User set this themselves, so admins should no longer see it in plaintext.
    await users.updateById(user._id, { password: hashedPassword, plainPassword: null });

    await logUserActivity(user._id, req.ip, "Reset password via forgot flow", user.username, "User", user._id);

    res.status(200).json({
      success: true,
      message: "Password updated successfully. You can sign in with your new password.",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.toString() });
  }
};
