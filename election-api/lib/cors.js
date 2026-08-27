function parseOrigins(raw) {
  return String(raw || "")
    .split(",")
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

function getAllowedOrigins() {
  const origins = parseOrigins(process.env.FRONTEND_URL);
  if (!origins.length) {
    throw new Error(
      "FRONTEND_URL is required. Set it to the portal origin (e.g. http://localhost:5173)."
    );
  }
  return origins;
}

function corsOrigin(origin, callback) {
  const allowed = getAllowedOrigins();
  if (!origin) {
    return callback(null, true);
  }
  const normalized = origin.replace(/\/$/, "");
  if (allowed.includes(normalized)) {
    return callback(null, true);
  }
  return callback(null, false);
}

module.exports = { corsOrigin, getAllowedOrigins, parseOrigins };
