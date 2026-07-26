const jwt = require("jsonwebtoken");
const users = require("../lib/supabase/users");

exports.protect = async (req, res, next) => {
  try {
    if (!req.headers.authorization) {
      return res.status(401).json({
        success: false,
        message: "Authorization header missing",
      });
    }

    const parts = req.headers.authorization.split(" ");
    const token = parts[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token missing",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await users.findById(decoded.id, { includePassword: false });
    if (!req.user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }
    if (req.user.status === "inactive") {
      return res.status(401).json({
        success: false,
        message: "This account is inactive. Please sign in with an active account.",
      });
    }
    next();
  } catch (err) {
    console.error(err);
    return res.status(401).json({
      success: false,
      message: "Not authorized to access this route",
    });
  }
};

exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req?.user?.role)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user?.role} is not authorized to access this route`,
      });
    }
    next();
  };
};
